import { WorkflowScheduler } from './src/services/scheduler';

console.log('Starting Viralis autopilot daemon…');
WorkflowScheduler.initCronJobs();

process.stdin.resume();
console.log('Daemon running. Ctrl+C to exit.');
