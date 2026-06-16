module.exports = {
  apps: [
    {
      name: "hermes-gateway",
      script: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe",
      args: "-m hermes_cli.main gateway run --replace",
      cwd: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent",
      env: {
        HERMES_HOME: "C:\\Users\\ismadmin\\AppData\\Local\\hermes",
        PYTHONIOENCODING: "utf-8",
        HERMES_GATEWAY_DETACHED: "1"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "hermes-dashboard",
      script: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe",
      args: "-m hermes_cli.main dashboard --no-open --tui --skip-build --insecure --host 0.0.0.0",
      cwd: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent",
      env: {
        HERMES_HOME: "C:\\Users\\ismadmin\\AppData\\Local\\hermes",
        PYTHONIOENCODING: "utf-8"
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "hermes-frontend",
      script: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\node\\node_modules\\npm\\bin\\npm-cli.js",
      args: "run dev",
      cwd: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent\\web",
      env: {
        PATH: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\node;" + process.env.PATH
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "hermes-healthchecker-orchestrator",
      script: "C:\\Users\\ismadmin\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe",
      args: "C:\\Users\\ismadmin\\Documents\\Workspace\\Pn6_HealthChecker\\orchestrator.py",
      cwd: "C:\\Users\\ismadmin\\Documents\\Workspace\\Pn6_HealthChecker",
      autorestart: false,
      cron_restart: "*/30 * * * *",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
