import { WorkflowScheduler } from './src/services/scheduler';

console.log("Starting AI Social Media Automator Daemon...");
WorkflowScheduler.initCronJobs();

// Keep process alive
process.stdin.resume();

console.log("Daemon is running in the background. Press Ctrl+C to exit.");
