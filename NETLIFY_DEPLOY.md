# Netlify Deploy Checklist

This project deploys to Netlify as a Vite frontend plus a Netlify Function API.

## Build Settings

Netlify reads these from `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

## Environment Variables

Set these in Netlify site settings under Environment variables:

```env
MYSQL_HOST=your-cloud-mysql-host
MYSQL_PORT=3306
MYSQL_USER=your-cloud-mysql-user
MYSQL_PASSWORD=your-cloud-mysql-password
MYSQL_DATABASE=void_striker
MYSQL_SSL=true
VITE_API_BASE=/api
```

Use `MYSQL_SSL=false` only if your database provider does not require SSL.

## Important

Do not use `localhost` for `MYSQL_HOST` on Netlify. Netlify runs in the cloud, so it needs a hosted MySQL database that accepts remote connections.

The API function creates the database tables and seed data automatically on first request.
