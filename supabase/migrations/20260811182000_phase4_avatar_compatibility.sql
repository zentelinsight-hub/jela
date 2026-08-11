-- Preserve owner-only reads and cleanup for pre-Phase-4 avatar objects while all
-- new pointers and uploads remain immutable and versioned.
drop policy if exists "Users read only their avatars" on storage.objects;
drop policy if exists "Users delete only versioned avatars" on storage.objects;

create policy "Users read only their avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (
    name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
    or name ~ ('^' || auth.uid()::text || '/avatar\.(jpg|jpeg|png|webp)$')
  )
);

create policy "Users delete their owned avatar versions"
on storage.objects for delete to authenticated
using (
  bucket_id = 'jela-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
  and (
    name ~ ('^' || auth.uid()::text || '/avatars/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
    or name ~ ('^' || auth.uid()::text || '/avatar\.(jpg|jpeg|png|webp)$')
  )
);
