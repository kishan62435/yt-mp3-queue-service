import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import Queue from 'bull';
import express from 'express';

export class MonitoringService {
  private serverAdapter: ExpressAdapter;

  constructor(queues: Queue.Queue[]) {
    this.serverAdapter = new ExpressAdapter();

    // Configure the adapter's base path
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: queues.map(queue => new BullAdapter(queue)),
      serverAdapter: this.serverAdapter,
    });
  }

  public getRouter(): express.Router {
    return this.serverAdapter.getRouter();
  }
}