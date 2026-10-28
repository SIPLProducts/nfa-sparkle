// PM2 configuration for the eNFA PRODUCTION SAP middleware.
//
//   cd /apps/webapplications/NFA_Approval/Production/middleware
//   npm install --omit=dev
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup            # run the printed command once, as root
//
// Restart / logs / stop (this app only - other PM2 apps are untouched):
//   pm2 restart enfa-production-middleware
//   pm2 logs    enfa-production-middleware
//   pm2 stop    enfa-production-middleware

module.exports = {
  apps: [
    {
      name: "enfa-production-middleware",
      cwd: "/apps/webapplications/NFA_Approval/Production/middleware",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3015,
      },
      out_file: "/apps/webapplications/NFA_Approval/Production/middleware/logs/out.log",
      error_file: "/apps/webapplications/NFA_Approval/Production/middleware/logs/err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
