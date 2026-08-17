# Core Concepts

## Domain Model

### User
A person on the platform. Every user has a profile. Users can be:
- **Seeker:** Someone looking for services
- **Provider:** Someone offering services
- **Business:** A provider with a team/workspace

### Profile
The public-facing identity. Contains: name, headline, bio, location, services, availability, trust score, verification level.

### Help Request
A consumer's need: "I need an electrician to fix a switch." Contains title, details, category, budget, location, urgency. Matched with providers via AI.

### Order
The formal engagement between a consumer and provider. Tracks status, price, commission, payment. Created from help requests, listings, or direct booking.

### Service Listing
A provider's offering: "AC Repair - ₹500 onwards." Can be legacy (service_listings) or V2 (services).

### Product Listing
A provider's product for sale. Can be legacy (product_catalog) or V2 (products).

### Quote
A provider's response to a help request: line-itemed pricing with validity. Supports versioning/negotiation.

### Conversation
A chat channel between two users. Created on-demand. Supports text + image messages.

### Connection
A relationship between two users. Pending → Accepted. Optional (chat works without it).

### Review
A 1-5 rating + comment from a consumer about a provider. Supports helpful votes.

### Trust Score
A 0-100 score computed from 6 inputs: rating, job completion, on-time rate, repeat clients, verification level, response time.

### Workspace
A business entity with branches, members, and lead routing rules.

### Subscription
A provider's paid plan (Free/Essential/Premium) that unlocks features.

### Feed
A personalized stream of help requests, services, and products. Supports save, share, and report.

### Locality
A geographic area (housing society, market, supply area) with coordinates and radius.

### Market Zone
A larger geographic region containing multiple localities.
