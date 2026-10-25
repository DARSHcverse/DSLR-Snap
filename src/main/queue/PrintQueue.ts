import { EventEmitter } from 'node:events'
import type { PrintFormat, PrintJob } from '../../shared/types'
import type { BoothDatabase } from '../db/database'
import type { PrinterAdapter } from '../printer/PrinterAdapter'

/**
 * Persistent, one-at-a-time print queue.
 *
 * Duplicate protection:
 *  - enqueue is idempotent per (session, requestKey)
 *  - a job moves queued → sending → sent|failed via compare-and-set
 *  - failed jobs are never retried automatically; the operator presses Retry
 *  - jobs interrupted mid-send become needs_check on restart (they may have printed)
 */
export class PrintQueue extends EventEmitter {
  private running = false
  private stopped = false

  constructor(private db: BoothDatabase, private getPrinter: () => PrinterAdapter) {
    super()
    const flagged = db.flagInterruptedPrintJobs()
    if (flagged) this.emit('changed')
  }

  enqueue(sessionId: string, requestKey: string, filePath: string, format: PrintFormat, copies: number): PrintJob {
    const job = this.db.insertPrintJob(sessionId, requestKey, filePath, format, copies)
    this.emit('changed')
    void this.drain()
    return job
  }

  /** Operator-initiated only. */
  retry(jobId: string): boolean {
    const ok = this.db.transitionPrintJob(jobId, ['failed', 'needs_check'], 'queued')
    if (ok) {
      this.emit('changed')
      void this.drain()
    }
    return ok
  }

  cancel(jobId: string): boolean {
    const ok = this.db.transitionPrintJob(jobId, ['queued', 'failed', 'needs_check'], 'cancelled')
    if (ok) this.emit('changed')
    return ok
  }

  /** Operator confirms an interrupted job did print. */
  markPrinted(jobId: string): boolean {
    const ok = this.db.transitionPrintJob(jobId, ['needs_check', 'failed'], 'sent')
    if (ok) this.emit('changed')
    return ok
  }

  pendingCount(): number {
    return this.db.listPrintJobs(500).filter((j) => j.status === 'queued' || j.status === 'sending').length
  }

  stop(): void {
    this.stopped = true
  }

  /** Processes queued jobs sequentially. Safe to call repeatedly. Resolves when the queue is empty. */
  async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (!this.stopped) {
        const job = this.db.nextQueuedPrintJob()
        if (!job) break
        if (!this.db.transitionPrintJob(job.id, ['queued'], 'sending', { incAttempts: true })) continue
        this.emit('changed')
        try {
          await this.getPrinter().print({ filePath: job.filePath, format: job.format, copies: job.copies, jobName: `booth-${job.id.slice(0, 8)}` })
          this.db.transitionPrintJob(job.id, ['sending'], 'sent')
        } catch (e) {
          this.db.transitionPrintJob(job.id, ['sending'], 'failed', { error: e instanceof Error ? e.message : String(e) })
          this.emit('jobFailed', job.id, e)
        }
        this.emit('changed')
      }
    } finally {
      this.running = false
    }
  }
}
