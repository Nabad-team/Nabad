# Wellbeing support verification

The Wellbeing Corner on the dashboard displays each support number's own
`verifiedOn` date, immediately beside that entry, with a link to its official
source. Records live in `frontend/data/wellbeingSupport.js`. Dates are date-only
`YYYY-MM-DD` values and display as day/month-name/year without timezone shifting.
Missing or invalid dates display “Verification date unavailable”; calling remains
available. There is no shared verification date or automatic date refresh.

## Source review on 31 October 2026

The following official pages were retrieved successfully with HTTPS verification
enabled. This was a review of published contact information, not a test call or
confirmation of current phone-line availability.

| Number | Official source | Evidence checked | Recorded review date |
| --- | --- | --- | --- |
| National Lifeline 1564 | https://embracelebanon.org/what-we-do/the-national-lifeline/ | The page names National Lifeline 1564 and states that it is operated by Embrace in partnership with the National Mental Health Programme at the Ministry of Public Health, with 24/7 availability. | 2026-10-31 |
| Lebanese Red Cross 140 | https://www.redcross.org.lb/ems-article/ | The EMS page identifies 140 as its national medical emergency hotline. Its service statistics are historical; reviewing this published number does not establish live availability. | 2026-10-31 |

Both entries previously shared the label “Numbers last verified: October 16,
2026.” Their dates were updated only after the source reviews above. The records
remain independent even when reviews happen on the same day.

## Updating an entry

Check the number and relevant description against its official source. Update
only that contact's number/description, source URL and actual review date. Do not
advance dates during builds, deployments or unrelated edits. If no review date is
known, leave `verifiedOn` absent rather than inventing one. If a source is
unavailable, retain the previous review date until a review can be completed.

Run the WellbeingCorner frontend tests after edits. They check that dates remain
associated with their own callable entries, different dates render independently,
invalid dates are labelled honestly, and a later render does not fabricate a new
verification date. The full Selenium suite also checks both displayed entries.
