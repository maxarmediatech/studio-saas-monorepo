# Quotation UI comparison

Authenticated screenshots captured from the same browser viewport and the same
`localhost:3000` origin. The old frontend branch ran first, followed by the
current quotation implementation, so Better Auth kept working without a second
port.

| Old frontend (`codex/quote-booking-foundation`) | Current implementation (`codex/quotation-system`) |
| --- | --- |
| **1. Clients**<br>![Old clients step](old-01-clients.png) | **1. Proposal**<br>![Current proposal step](current-01-proposal.png) |
| **2. Details**<br>![Old details step](old-02-details.png) | **2. Pricing**<br>![Current pricing step](current-02-pricing.png) |
| **3. Packages**<br>![Old packages step](old-03-packages.png) | **3. Booking**<br>![Current booking step](current-03-booking.png) |
| **4. Terms**<br>![Old terms step](old-04-terms.png) | **4. Operations**<br>![Current operations step](current-04-operations.png) |
| **5. Preview**<br>![Old preview step](old-05-preview.png) | **5. Review**<br>![Current review step](current-05-review.png) |

## Plain-language difference

The old branch is a frontend quotation mock-up focused on collecting client,
event, package, and terms information before previewing a document. The current
version is a working quotation workflow connected to backend data. It separates
the commercial proposal and pricing from what happens after acceptance: booking,
crew/operations, and final review.

The visual structure is related—a five-step editor with a main form and step
navigation—but it is not the same frontend. Labels, information grouping,
navigation, and the surrounding app sidebar have all changed.
