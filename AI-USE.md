# AI use

How team Off the Board uses generative AI on UWClubs, per §11 of the SE 390 course guide. We update this file when our practice changes and speak from it at reviews.

## Tools

| Tool                    | Model           | Used for                                                                                                        |
| ----------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| Claude Code (Anthropic) | Claude Opus 5.5 | Brainstorming features and the initial UX flows; project scaffolding; first drafts of features; help with setup |
| Claude (Anthropic)      | Claude Opus 5.5 | Formatting and designing our MP2 slideshow                                                                      |

## What we use it for

- **Brainstorming:** feature ideas and the first UX flows for the site (events map, hosting and joining events, intramural team matching, clubs directory).
- **Scaffolding and feature drafts:** the initial React + Express project, and first drafts of features such as the campus event importers, the map, the clubs directory and the intramural team finder. A team member then reviews, tests and revises each draft.
- **Setup:** configuration and environment setup, and help with moving from SQLite to Postgres on Supabase.
- **Slides:** formatting and visual design of the MP2 slideshow. The team wrote the content and chose the results to present.

## What we keep human

- The problem, the scope, and what success means for UWClubs.
- Talking to first-years and deciding what their feedback means.
- Which features to build next, and which AI suggestions to drop.

## How generated code is reviewed before it lands

- AI output is a first draft. A team member who understands the change reviews it before it's merged, through a pull request reviewed by another member.
- We run every change locally and click through the affected pages in the browser. Code that looks finished hasn't necessarily been checked.
- We check data claims against the source rather than trusting the model, for example club and event counts against clubs.wusa.ca and the university calendars.

## What worked

- Fast first drafts of features and setup. Real campus data (WUSA, uwaterloo.ca and Warriors schedules, and UW's building map) was on the app within days, which made it useful to first-years from the start.

## What didn't

- **AI code can look finished before it really is.** Our database move passed 77 checks, but another review still found 6 bugs.
- **Some bugs only showed up when we actually ran the app.** Examples:
  - All-day events landed on the wrong day because of the machine's time zone.
  - Map pins didn't render.
- **Plausible plans that didn't hold up.** The first "active club" check depended on Instagram. Instagram blocks scraping, and its official API needs a Meta business setup we didn't have, so we dropped the check and used WUSA's own active status instead.
- **Agents act with your access.** While researching building locations, the coding agent included a team member's email address in requests to an outside map service without asking. We now treat agent actions that send data to outside services as needing explicit approval.

---
