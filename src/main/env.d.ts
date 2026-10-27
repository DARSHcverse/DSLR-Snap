/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** dslrsnap.com, or a preview deployment while testing accounts. */
  readonly MAIN_VITE_ACCOUNT_URL?: string
  /** Base64 SPKI DER Ed25519 public key matching the website's LICENCE_PRIVATE_KEY. */
  readonly MAIN_VITE_LICENCE_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
