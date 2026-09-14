-- Keep the private request-document bucket aligned with the recipient form.
update storage.buckets
set file_size_limit = 20971520
where id = 'request-supporting-documents';
