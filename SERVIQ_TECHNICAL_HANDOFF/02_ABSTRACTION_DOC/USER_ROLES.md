# User Roles

## Role Types

| Role | Description | Can Post Needs | Can Offer Services | Can Join Workspace |
|------|-------------|:-:|:-:|:-:|
| Seeker | Consumer looking for services | Yes | No | No |
| Provider | Service professional | Yes | Yes | Yes (as member) |
| Business | Provider with team | Yes | Yes | Yes (as owner/admin) |

## Role Transitions
- A user starts as **Seeker** by default
- During onboarding, they can choose to become a **Provider**
- A Provider can create a **Workspace** to become a **Business**
- Role is stored in `profiles.role` (normalized: 'seeker'/'provider'/'business')

## Admin
- `profiles.is_admin = true` grants admin access
- Admin can: update any profile, moderate listings, manage feature flags
- Admin RLS policies: separate INSERT/UPDATE policies on profiles

## Permission Matrix

| Action | Seeker | Provider | Business | Admin |
|--------|:------:|:--------:|:--------:|:-----:|
| Create help request | Yes | Yes | Yes | Yes |
| Create service listing | No | Yes | Yes | Yes |
| Create product listing | No | Yes | Yes | Yes |
| Accept help request | No | Yes | Yes | Yes |
| Send quote | No | Yes | Yes | Yes |
| Create order | Yes | Yes | Yes | Yes |
| Leave review | Yes | Yes | Yes | Yes |
| Create workspace | No | No | Yes | Yes |
| Join workspace | No | Yes | Yes | Yes |
| Moderate listings | No | No | No | Yes |
| Suspend users | No | No | No | Yes |
| Manage feature flags | No | No | No | Yes |
