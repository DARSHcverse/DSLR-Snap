-- Brand images (logos are often PNG with transparency, banners WebP) go in the private gallery bucket too.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/gif', 'image/png', 'image/webp', 'video/mp4']
where id = 'galleries';
