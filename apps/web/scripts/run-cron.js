#!/usr/bin/env node

import fetch from 'node-fetch';

const CRON_URL = 'http://localhost:3000/api/cron/drift-check';
const CRON_SECRET = process.env.CRON_SECRET;

setInterval(async () => {
  try {
    const response = await fetch(CRON_URL, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    if (response.ok) {
      console.log('Drift check completed');
    } else {
      console.error('Drift check failed');
    }
  } catch (error) {
    console.error('Error running drift check:', error);
  }
}, 6 * 60 * 60 * 1000); // Every 6 hours