-- Allow MP4 clips (boomerangs now; video booth and 360 next) in the private gallery bucket, up to 120 MB.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/gif', 'video/mp4'], file_size_limit = 125829120
where id = 'galleries';
