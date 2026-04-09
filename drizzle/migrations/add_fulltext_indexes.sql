-- Standard indexes for search performance (TiDB does not support FULLTEXT)
-- These indexes help with prefix LIKE queries and accountId filtering

-- Contacts: accountId column is "accountId", name columns are "firstName", "lastName"
ALTER TABLE contacts ADD INDEX idx_contacts_search_name (accountId, firstName);
ALTER TABLE contacts ADD INDEX idx_contacts_search_lname (accountId, lastName);
ALTER TABLE contacts ADD INDEX idx_contacts_search_email (accountId, email);

-- Campaigns: accountId column is "accountId", name column is "name"
ALTER TABLE campaigns ADD INDEX idx_campaigns_search_name (accountId, name);

-- Long form content: accountId column is "account_id", title column is "title"
ALTER TABLE long_form_content ADD INDEX idx_content_search_title (account_id, title(255));

-- Sequences: accountId column is "account_id", name column is "name"
ALTER TABLE sequences ADD INDEX idx_sequences_search_name (account_id, name);

-- Deals: accountId column is "account_id", title column is "title"
ALTER TABLE deals ADD INDEX idx_deals_search_title (account_id, title(255));
