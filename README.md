# LostFound

> A campus lost-and-found experience for reporting, discovering, claiming, and safely returning items.

## Live Demo

[Open LostFound](https://lost-find-found.netlify.app/)

## Features

### Discovery
- Search item names, descriptions, categories, and campus locations.
- Filter by Lost / Found, category, status, location, and date range.
- Sort newest, oldest, urgent, or by text-match relevance.
- See suggested matching reports of the opposite type.
- Open a reported location in OpenStreetMap.

### Item recovery
- Create Lost and Found reports with optional image and lost/found date.
- Track Searching → Contacted → Submitted → Returned.
- Submit claims for found items using a private identifying clue.
- Let the finder approve or reject pending claims.
- Add comments and send demo private messages.
- Copy a shareable link that opens a specific report.
- Manage and delete your own posts.

### Notifications
- In-app notifications for claims, messages, comments, reports, and status updates.
- Mark individual notifications or all notifications as read.

### Moderation and insights
- Report inappropriate posts with a reason.
- Review open flags, hide/restore posts, and resolve flags.
- View counts for Lost, Found, Returned, pending claims, and open flags.
- View a ranked summary of campus locations.

### UI and safety
- Responsive layout and light/dark theme.
- Image preview with a 2 MB upload limit.
- Input escaping, empty states, and user-facing feedback.
- Safety guidance to keep private identifying details out of public posts.

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 |
| Logic | Vanilla JavaScript ES modules |
| Storage | Browser localStorage |
| Images | FileReader / browser data URLs |
| Deployment | Netlify |

No framework or external UI library is required.

## Project Structure

```
LostFound/
├── index.html
├── login.html
├── post.html
├── myposts.html
├── notifications.html
├── admin.html
├── css/
│   ├── style.css
│   └── features.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── posts.js
│   └── ui.js
└── assets/
```

## Important prototype limitations

This is still a frontend prototype. Its new features demonstrate the user flow, but are not a production trust or security boundary:

- Login validates a 10-digit campus ID in the browser only; it does not verify campus identity.
- Reports, claims, messages, notifications, and moderation flags are stored in the current browser's localStorage. They are not synchronized between users or devices.
- The moderation page is a demo and is not protected by server-side administrator roles.
- Private messages are visible only within this browser's local demo data; they are not delivered to another device.
- Claim proof is stored locally. Do not enter passwords, government ID numbers, or other highly sensitive information.
- Images are stored as browser data URLs and may consume local storage.
- The OpenStreetMap link searches the location text; it does not verify a campus building's exact coordinates.
- A real deployment should use verified campus authentication, a server API, PostgreSQL, object storage, server-enforced authorization, abuse controls, and actual email/push notifications.

## Suggested production architecture

Frontend → Secure Campus Authentication → REST API → PostgreSQL → Object Storage → Notifications / Private Messaging

Before using real student data, move all trust-sensitive operations to the backend and enforce ownership and administrator permissions on the server.

## License

For educational and portfolio use.
