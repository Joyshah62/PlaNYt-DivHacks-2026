# RentCheck — Hackathon Data & Architecture Plan

## Product Idea

RentCheck is an all-in-one apartment intelligence website.

A user enters an apartment address, and the platform gives them a complete overview of:

- Building violations and maintenance problems
- Nearby food, supermarkets, gyms, parks, pharmacies, and other amenities
- Estimated travel distance and time to important places
- Personalized recommendations based on the user's lifestyle and preferences
- A simple apartment match score

The goal is to help renters answer:

> **Is this actually a good place for me to live?**

---

## High-Level Architecture

```text
                    Apartment Address
                           ↓
                Geocode → lat/lon
                     Nominatim
                           ↓
        ┌──────────────────┼───────────────────┐
        ↓                  ↓                   ↓
 Building data        Nearby places       Travel times
 violations           supermarkets        NYC / Rutgers
 complaints           restaurants         work / school
 landlord history     gyms / parks        custom places
        ↓                  ↓                   ↓
 NYC/NJ Open Data      OpenStreetMap          OSRM
                         Overpass
        └──────────────────┼───────────────────┘
                           ↓
                    Personalization
                           ↓
                    RentCheck Score
```

---

## 1. Address → Coordinates

The first step is converting an address such as:

```text
123 Example St, Newark, NJ
```

into latitude and longitude:

```json
{
  "lat": 40.7421,
  "lon": -74.1753
}
```

### Recommended Source

**Nominatim / OpenStreetMap**

Use Nominatim to geocode the apartment address.

These coordinates become the central identifier used by the rest of the system.

---

## 2. Building Problems & Violations

The available data depends on the apartment's city.

### NYC

NYC has excellent public housing datasets.

Potential sources:

- NYC HPD Housing Violations
- NYC Housing Maintenance Complaints
- NYC 311 Service Requests

Useful information includes:

- Mold
- Heating problems
- Plumbing problems
- Pest complaints
- Electrical issues
- Structural problems
- Open vs resolved violations
- Noise complaints
- Garbage complaints
- Water issues

Example output:

```text
BUILDING HISTORY

⚠ 17 HPD violations
   3 currently open

📞 23 housing complaints
   Past 3 years

Most common:
• Heating — 8
• Pests — 6
• Plumbing — 5
• Mold — 4
```

### Newark / New Jersey

Newark data is less centralized than NYC.

Potential sources include:

- Newark Code Enforcement
- Newark inspection data
- Newark Non-Compliant Landlord List
- Public housing and safety records

Possible metrics include:

- Violations issued
- Active conditions
- Court cases
- Heat / hot-water problems
- Building condition complaints
- Landlord compliance history

### MVP Scope

For the hackathon:

```text
NYC
→ Full HPD + complaint analysis

Newark
→ Available landlord / violation / compliance information

Other NJ cities
→ Limited support initially
```

Focus on **NYC + Newark** rather than trying to support every municipality.

---

## 3. Nearby Places & Amenities

Use **OpenStreetMap + Overpass API**.

Once the apartment coordinates are known, search within a radius such as:

```text
500 meters
1000 meters
1500 meters
```

### Categories

Potential nearby places:

- Restaurants
- Cafes
- Supermarkets
- Convenience stores
- Pharmacies
- Gyms
- Parks
- Bars
- Entertainment
- Train stations
- Bus stops
- Hospitals
- Universities

Instead of displaying every location, summarize the area.

Example:

```text
AROUND YOU

🛒 Groceries
3 within 10 min walk
Nearest: Whole Foods — 0.3 mi

🍴 Food
28 restaurants within 0.5 mi
8 Asian
5 Indian
4 Italian

☕ Coffee
7 cafes within 10 min

🏋️ Fitness
3 gyms nearby

🌳 Outdoors
2 parks within 15 min
```

---

## 4. Travel Distance & Estimated Time

Use **OSRM** for route distance and estimated travel time.

Maintain a predefined list of popular destinations.

Example:

```javascript
const popularPlaces = [
  "Rutgers Newark",
  "Newark Penn Station",
  "Newark Airport",
  "Times Square",
  "World Trade Center",
  "Central Park"
];
```

Geocode these destinations once and store their coordinates.

Then calculate:

```text
Apartment coordinates
        ↓
      OSRM
        ↓
Destination coordinates
```

Example output:

```text
GETTING AROUND

🚉 Newark Penn
8 min · 1.8 mi

🎓 Rutgers Newark
6 min · 1.2 mi

✈️ Newark Airport
14 min · 5.6 mi

🏙️ Manhattan
31 min · 12.4 mi

🌳 Central Park
42 min · 16.8 mi
```

These are **estimated route times**, not live traffic ETAs.

That is sufficient for the hackathon MVP.

---

## 5. Personalized Lifestyle Preferences

Ask users what matters most when choosing where to live.

Example:

```text
What matters most to you?

☐ Short commute
☐ Restaurants
☐ Indian food
☐ Asian food
☐ Nightlife
☐ Grocery stores
☐ Fitness
☐ Parks
☐ Coffee shops
☐ Public transit
☐ Quiet neighborhood
☐ Entertainment
```

Also allow users to enter destinations they frequently travel to.

```text
Where do you travel frequently?

Work / School:
[ Rutgers University ]

Other:
[ Manhattan ]
```

### Example

A user selects:

```text
Indian food
Gym
Groceries
Rutgers
```

The platform might return:

```text
YOUR LIFESTYLE

⭐⭐⭐⭐⭐ Food
11 Indian restaurants nearby

⭐⭐⭐⭐☆ Fitness
3 gyms within 15 minutes

⭐⭐⭐⭐⭐ Groceries
4 supermarkets within 10 minutes

⭐⭐⭐⭐☆ Commute
Rutgers: ~12 minutes
```

Different users can therefore receive different assessments for the same apartment.

---

## 6. Scoring System

The final score should be calculated deterministically.

Do **not** use an LLM to decide whether an apartment is good.

Example default weights:

```text
Building Health      30%
Commute              25%
Lifestyle            25%
Neighborhood Access  20%
```

If a user says commute matters most:

```text
Building Health      25%
Commute              40%
Lifestyle            20%
Neighborhood Access  15%
```

Example result:

```text
YOUR MATCH

86 / 100

Building       78
Commute        94
Food           92
Groceries      87
Fitness        81
```

An LLM can optionally explain these results in natural language.

Example:

> This apartment is a strong match because it has excellent access to Rutgers and several grocery stores and Indian restaurants nearby. The main tradeoff is its recent building maintenance history.

The data and score remain deterministic.

---

## 7. APIs & Data Sources

| Information | Source | Cost |
|---|---|---|
| Address → coordinates | Nominatim / OpenStreetMap | Free |
| Nearby restaurants | Overpass / OpenStreetMap | Free |
| Supermarkets | Overpass / OpenStreetMap | Free |
| Gyms | Overpass / OpenStreetMap | Free |
| Parks | Overpass / OpenStreetMap | Free |
| Transit stops | Overpass / OpenStreetMap | Free |
| Driving distance | OSRM | Free / Open Source |
| Driving time | OSRM | Free / Open Source |
| NYC violations | NYC HPD Open Data | Free |
| NYC complaints | NYC HPD / NYC 311 | Free |
| Newark problems | Newark public datasets | Free |
| Personalized score | Our algorithm | Free |
| Natural-language explanation | LLM | Optional |

Most of the hackathon can therefore run using free/open data.

---

## 8. Backend Flow

The frontend sends one request:

```http
GET /api/apartment-report?address=123+Main+Street...
```

The backend then performs:

```text
1. Nominatim
      ↓
   Get coordinates

2. Detect city
      ↓
   NYC / Newark

3. Fetch data in parallel

   Promise.all([
      violations(),
      complaints(),
      nearbyPlaces(),
      commuteTimes()
   ])

4. Calculate personalized scores

5. Return one JSON response
```

---

## 9. Example API Response

```json
{
  "address": "123 Main Street, Newark, NJ",

  "building": {
    "violations": 8,
    "openViolations": 2,
    "complaints": 13
  },

  "nearby": {
    "restaurants": 34,
    "groceries": 4,
    "gyms": 3,
    "parks": 2
  },

  "commute": {
    "rutgers": {
      "minutes": 11,
      "miles": 3.2
    },
    "manhattan": {
      "minutes": 32,
      "miles": 12.1
    }
  },

  "scores": {
    "building": 72,
    "convenience": 91,
    "commute": 87,
    "personalMatch": 89
  }
}
```

The frontend primarily needs to visualize this response.

---

## 10. Suggested Result Page

Keep the result page simple and easy to scan.

### Apartment Health

Show:

- Total violations
- Open violations
- Complaint history
- Most common problems

### Around You

Show:

- Food
- Groceries
- Coffee
- Gyms
- Parks
- Transit
- Entertainment

### Getting Around

Show travel estimates to:

- Rutgers
- Newark Penn
- Newark Airport
- Manhattan
- Times Square
- Central Park
- User-defined work/school destinations

### Your Match

Show:

- Overall personalized score
- Building score
- Commute score
- Lifestyle score
- Convenience score
- Short explanation

---

## 11. Hackathon MVP

Prioritize these features:

1. User enters an apartment address.
2. Geocode with Nominatim.
3. Retrieve NYC/Newark violation data.
4. Query nearby places using Overpass.
5. Calculate travel times using OSRM.
6. Ask the user for lifestyle preferences.
7. Generate a personalized score.
8. Present everything in one clean dashboard.

### Core Demo

```text
Apartment Address
        ↓
Apartment Health
        ↓
Around You
        ↓
Getting Around
        ↓
Your Personalized Match
```

---

## 12. Stretch Goals

Only build these if the core product is finished:

- Crime statistics
- Historical rent prices
- School information
- Noise analysis
- Street imagery
- Landlord reviews
- Apartment comparison
- Saved apartments
- User accounts
- AI-generated neighborhood summary

---

## Final MVP Stack

```text
Frontend
Next.js / React

Backend
Next.js API routes / Node.js

Geocoding
Nominatim

Nearby Places
OpenStreetMap + Overpass

Routing
OSRM

NYC Housing Data
NYC Open Data / HPD / 311

Newark Housing Data
Newark public datasets

Database
PostgreSQL / Supabase

Scoring
Custom deterministic algorithm

Optional Explanation
LLM
```

The main hackathon goal should be to make the result **easy to understand**, not to make the system production-scale.

The core value proposition is:

> **Enter an apartment address and instantly understand the building, neighborhood, commute, and how well the location fits your lifestyle.**
