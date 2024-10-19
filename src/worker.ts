import { startWorker } from './workers/conversionWorker';
// import { v4 as uuidv4 } from 'uuid';
import { v4 as uuidv4 } from 'uuid';

const workerId = uuidv4();
startWorker(workerId).catch(error => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
console.log('worker started successfully:', workerId);



// src/startWorkers.ts
// import { startWorker } from './workers/conversionWorker';
// import { v4 as uuidv4 } from 'uuid';

// const numberOfWorkers = 4;

// async function startWorkers() {
//   try {
//     const workers = [];
//     for (let i = 0; i < numberOfWorkers; i++) {
//       const workerId = uuidv4();
//       const worker = await startWorker(workerId);
//       workers.push(worker);
//     }
//     console.log(`Started ${numberOfWorkers} workers successfully`);
//   } catch (error) {
//     console.error('Error starting workers:', error);
//     process.exit(1);
//   }
// }

// startWorkers();