import { startWorker } from './workers/conversionWorker';
// import { v4 as uuidv4 } from 'uuid';
import { v4 as uuidv4 } from 'uuid';

const workerId = uuidv4();
startWorker(workerId).catch(error => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});