-- Erzwingt "Slot-Trainer muss aktiven Contract mit der Company haben"
-- (PLANNING.md Abschnitt 3) auch für course_plan_slots per RLS WITH CHECK,
-- analog zur bestehenden Regel bei course_sessions.

create function company_id_for_plan(target_plan_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.company_id from course_plans cp
  join studios s on s.id = cp.studio_id
  where cp.id = target_plan_id;
$$;

drop policy if exists "course_plan_slots: company_admin/platform_admin" on course_plan_slots;

create policy "course_plan_slots: company_admin/platform_admin"
  on course_plan_slots for all
  using (
    is_platform_admin() or
    is_company_admin(company_id_for_plan(course_plan_id))
  )
  with check (
    is_platform_admin() or (
      is_company_admin(company_id_for_plan(course_plan_id)) and
      has_active_contract(trainer_id, company_id_for_plan(course_plan_id))
    )
  );
