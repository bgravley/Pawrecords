-- YourPetPass database performance hardening.
-- Removes redundant owner policies, caches auth.uid() once per statement,
-- and adds covering indexes for foreign keys used throughout the app.

-- ---------------------------------------------------------------------------
-- RLS: consolidate duplicate policies and use (select auth.uid()).
-- ---------------------------------------------------------------------------

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "own dogs" on public.dogs;
create policy "own dogs" on public.dogs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own vaccinations" on public.vaccinations;
create policy "own vaccinations" on public.vaccinations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own medications" on public.medications;
create policy "own medications" on public.medications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own allergies" on public.allergies;
create policy "own allergies" on public.allergies
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own vet_visits" on public.vet_visits;
create policy "own vet_visits" on public.vet_visits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own weights" on public.weights;
drop policy if exists "own weights" on public.weights;
create policy "own weights" on public.weights
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own saved_vets" on public.saved_vets;
create policy "own saved_vets" on public.saved_vets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own trip_documents" on public.trip_documents;
create policy "own trip_documents" on public.trip_documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own contacts" on public.emergency_contacts;
drop policy if exists "own emergency_contacts" on public.emergency_contacts;
create policy "own emergency_contacts" on public.emergency_contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own trip_checklist_items" on public.trip_checklist_items;
create policy "own trip_checklist_items" on public.trip_checklist_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own trip legs" on public.trip_legs;
create policy "own trip legs" on public.trip_legs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Affiliate policies use the same cached auth lookup pattern.
drop policy if exists "Affiliates can view own record" on public.affiliates;
create policy "Affiliates can view own record" on public.affiliates
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Affiliates can update own payout info" on public.affiliates;
create policy "Affiliates can update own payout info" on public.affiliates
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Affiliates can view own commissions" on public.affiliate_commissions;
create policy "Affiliates can view own commissions" on public.affiliate_commissions
  for select to authenticated
  using (
    affiliate_id in (
      select a.id from public.affiliates a
      where a.user_id = (select auth.uid())
    )
  );

-- Remove exact duplicate insert policies while retaining the specific ones.
drop policy if exists "Insert only" on public.activity_log;
drop policy if exists "Insert only" on public.error_log;

-- ---------------------------------------------------------------------------
-- Foreign-key covering indexes.
-- ---------------------------------------------------------------------------
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_affiliate_commissions_affiliate_id on public.affiliate_commissions(affiliate_id);
create index if not exists idx_affiliate_commissions_referred_user_id on public.affiliate_commissions(referred_user_id);
create index if not exists idx_ai_usage_log_user_id on public.ai_usage_log(user_id);
create index if not exists idx_allergies_dog_id on public.allergies(dog_id);
create index if not exists idx_allergies_user_id on public.allergies(user_id);
create index if not exists idx_bug_reports_user_id on public.bug_reports(user_id);
create index if not exists idx_documents_dog_id on public.documents(dog_id);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_dogs_user_id on public.dogs(user_id);
create index if not exists idx_emergency_contacts_user_id on public.emergency_contacts(user_id);
create index if not exists idx_error_log_user_id on public.error_log(user_id);
create index if not exists idx_medications_dog_id on public.medications(dog_id);
create index if not exists idx_medications_user_id on public.medications(user_id);
create index if not exists idx_saved_vets_user_id on public.saved_vets(user_id);
create index if not exists idx_trip_checklist_items_leg_id on public.trip_checklist_items(leg_id);
create index if not exists idx_trip_checklist_items_user_id on public.trip_checklist_items(user_id);
create index if not exists idx_trip_documents_checklist_item_id on public.trip_documents(checklist_item_id);
create index if not exists idx_trip_documents_trip_id on public.trip_documents(trip_id);
create index if not exists idx_trip_documents_user_id on public.trip_documents(user_id);
create index if not exists idx_trip_legs_trip_id on public.trip_legs(trip_id);
create index if not exists idx_trip_legs_user_id on public.trip_legs(user_id);
create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_vaccinations_dog_id on public.vaccinations(dog_id);
create index if not exists idx_vaccinations_user_id on public.vaccinations(user_id);
create index if not exists idx_vet_visits_dog_id on public.vet_visits(dog_id);
create index if not exists idx_vet_visits_user_id on public.vet_visits(user_id);
create index if not exists idx_weights_dog_id on public.weights(dog_id);
create index if not exists idx_weights_user_id on public.weights(user_id);
