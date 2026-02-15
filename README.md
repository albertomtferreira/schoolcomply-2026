This is a [Next.js](https://nextjs.org) project for SchoolComply.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then bootstrap environment:

Create `.env.local` from `.env.example` and fill the Firebase dev values.
Ensure Java (JRE/JDK) is installed locally before running Firebase emulators.

Start Firebase emulators:

```bash
npm run firebase:login
npm run firebase:emulators
```

In a second terminal, run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See `docs/PlatformBootstrap.md` for full environment and promotion workflow.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
