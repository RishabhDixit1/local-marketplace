# ServiQ RLS Policies

## Policy Pattern Reference

### 1. Own-User Policies
```sql
-- User can read their own profile
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- User can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- User can read their own settings
CREATE POLICY "users_read_own_settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert their own settings
CREATE POLICY "users_insert_own_settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 2. Conversation-Participant Policies
```sql
-- Participants can read messages in their conversations
CREATE POLICY "participants_read_messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Participants can insert messages in their conversations
CREATE POLICY "participants_insert_messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Participants can read conversation participants
CREATE POLICY "participants_read_participants" ON conversation_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
    )
  );
```

### 3. Connection-Gated Policies
```sql
-- Users can see profiles of connected users
CREATE POLICY "connected_users_see_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM connection_requests
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND recipient_id = profiles.id)
        OR
        (recipient_id = auth.uid() AND requester_id = profiles.id)
      )
    )
  );
```

### 4. Admin-Only Policies
```sql
-- Admins can read all profiles
CREATE POLICY "admins_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update any profile
CREATE POLICY "admins_update_any_profile" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can delete any profile
CREATE POLICY "admins_delete_any_profile" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can manage feature flags
CREATE POLICY "admins_manage_feature_flags" ON feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

### 5. Public-Read Policies
```sql
-- Anyone can read public profiles
CREATE POLICY "public_read_profiles" ON profiles
  FOR SELECT USING (true);

-- Anyone can read service listings
CREATE POLICY "public_read_listings" ON service_listings
  FOR SELECT USING (true);

-- Anyone can read product catalog
CREATE POLICY "public_read_products" ON product_catalog
  FOR SELECT USING (true);

-- Anyone can read reviews
CREATE POLICY "public_read_reviews" ON reviews
  FOR SELECT USING (true);

-- Anyone can read service categories
CREATE POLICY "public_read_categories" ON service_categories
  FOR SELECT USING (true);

-- Anyone can read localities
CREATE POLICY "public_read_localities" ON localities
  FOR SELECT USING (true);
```

### 6. Provider-Owner Policies
```sql
-- Providers can manage their own listings
CREATE POLICY "providers_manage_own_listings" ON service_listings
  FOR ALL USING (auth.uid() = provider_id);

-- Providers can manage their own products
CREATE POLICY "providers_manage_own_products" ON product_catalog
  FOR ALL USING (auth.uid() = provider_id);

-- Providers can manage their own availability
CREATE POLICY "providers_manage_own_availability" ON provider_availability
  FOR ALL USING (auth.uid() = provider_id);

-- Providers can manage their own bank accounts
CREATE POLICY "providers_manage_own_bank_accounts" ON provider_bank_accounts
  FOR ALL USING (auth.uid() = provider_id);

-- Providers can read their own analytics
CREATE POLICY "providers_read_own_analytics" ON provider_analytics
  FOR SELECT USING (auth.uid() = provider_id);
```

### 7. Composite Key Policies
```sql
-- Connection requests: either party can read
CREATE POLICY "parties_read_connection_requests" ON connection_requests
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = recipient_id
  );

-- Connection requests: requester can insert
CREATE POLICY "requester_insert_connection_requests" ON connection_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Connection requests: recipient can update (accept/reject)
CREATE POLICY "recipient_update_connection_requests" ON connection_requests
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Orders: either party can read
CREATE POLICY "parties_read_orders" ON orders
  FOR SELECT USING (
    auth.uid() = consumer_id OR auth.uid() = provider_id
  );

-- Orders: either party can update (with transition validation at API layer)
CREATE POLICY "parties_update_orders" ON orders
  FOR UPDATE USING (
    auth.uid() = consumer_id OR auth.uid() = provider_id
  );

-- Help requests: requester can read
CREATE POLICY "requester_read_help_requests" ON help_requests
  FOR SELECT USING (auth.uid() = requester_id);

-- Help requests: matched providers can read
CREATE POLICY "matched_providers_read_help_requests" ON help_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM help_request_matches
      WHERE help_request_id = help_requests.id
      AND provider_id = auth.uid()
    )
  );
```

---

## Table-Specific Policies

### profiles
| Policy | Operation | Rule |
|--------|-----------|------|
| public_read_profiles | SELECT | `true` (anyone can read) |
| users_read_own_profile | SELECT | `auth.uid() = id` |
| users_update_own_profile | UPDATE | `auth.uid() = id` |
| admins_read_all_profiles | SELECT | `is_admin = true` |
| admins_update_any_profile | UPDATE | `is_admin = true` |

### orders
| Policy | Operation | Rule |
|--------|-----------|------|
| parties_read_orders | SELECT | `auth.uid() = consumer_id OR auth.uid() = provider_id` |
| parties_update_orders | UPDATE | `auth.uid() = consumer_id OR auth.uid() = provider_id` |
| admins_read_all_orders | SELECT | `is_admin = true` |

### messages
| Policy | Operation | Rule |
|--------|-----------|------|
| participants_read_messages | SELECT | EXISTS conversation_participants |
| participants_insert_messages | INSERT | `auth.uid() = sender_id` AND EXISTS conversation_participants |

### notifications
| Policy | Operation | Rule |
|--------|-----------|------|
| users_read_own_notifications | SELECT | `auth.uid() = user_id` |
| users_update_own_notifications | UPDATE | `auth.uid() = user_id` |
| system_insert_notifications | INSERT | `true` (service role only) |

### service_listings
| Policy | Operation | Rule |
|--------|-----------|------|
| public_read_listings | SELECT | `true` |
| providers_manage_own_listings | ALL | `auth.uid() = provider_id` |
| admins_manage_listings | ALL | `is_admin = true` |

### reviews
| Policy | Operation | Rule |
|--------|-----------|------|
| public_read_reviews | SELECT | `true` |
| users_insert_own_reviews | INSERT | `auth.uid() = reviewer_id` |
| users_update_own_reviews | UPDATE | `auth.uid() = reviewer_id` |

### connection_requests
| Policy | Operation | Rule |
|--------|-----------|------|
| parties_read_connection_requests | SELECT | requester_id OR recipient_id |
| requester_insert_connection_requests | INSERT | `auth.uid() = requester_id` |
| recipient_update_connection_requests | UPDATE | `auth.uid() = recipient_id` |

### user_settings
| Policy | Operation | Rule |
|--------|-----------|------|
| users_read_own_settings | SELECT | `auth.uid() = user_id` |
| users_insert_own_settings | INSERT | `auth.uid() = user_id` |
| users_update_own_settings | UPDATE | `auth.uid() = user_id` |

### blocked_users
| Policy | Operation | Rule |
|--------|-----------|------|
| users_read_own_blocks | SELECT | `auth.uid() = blocker_id` |
| users_insert_own_blocks | INSERT | `auth.uid() = blocker_id` |
| users_delete_own_blocks | DELETE | `auth.uid() = blocker_id` |

### feature_flags
| Policy | Operation | Rule |
|--------|-----------|------|
| admins_manage_feature_flags | ALL | `is_admin = true` |
| authenticated_read_flags | SELECT | `auth.role() = 'authenticated'` |

### help_requests
| Policy | Operation | Rule |
|--------|-----------|------|
| requester_read_help_requests | SELECT | `auth.uid() = requester_id` |
| matched_providers_read_help_requests | SELECT | EXISTS help_request_matches |
| admins_read_all_help_requests | SELECT | `is_admin = true` |

### provider_presence
| Policy | Operation | Rule |
|--------|-----------|------|
| public_read_presence | SELECT | `true` |
| providers_update_own_presence | UPDATE | `auth.uid() = provider_id` |
| providers_insert_own_presence | INSERT | `auth.uid() = provider_id` |

### rate_limits
| Policy | Operation | Rule |
|--------|-----------|------|
| service_role_all | ALL | `auth.role() = 'service_role'` |

### background_jobs
| Policy | Operation | Rule |
|--------|-----------|------|
| service_role_all | ALL | `auth.role() = 'service_role'` |
