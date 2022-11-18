import cron from 'node-cron';
import format from 'pg-format';
import axios from 'axios';
import { Pool } from 'pg';

const pool = new Pool();
// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

async function wsfQuery() {
  let config = {
    method: 'get',
    url: `https://www.wsdot.wa.gov/ferries/api/schedule/rest/alerts?apiaccesscode=${process.env.WSF_API_KEY}`,
  };

  axios(config)
    .then((response: { data: any[]; }) => {
      saveAlert(response.data);
    })
    .catch((error: any) => {
      console.log(error);
    });
}

async function saveAlert(rawAlerts: any[]) {
  const alerts = rawAlerts.map(rawAlert => [rawAlert.BulletinID, rawAlert]);
  const sql = format(`INSERT INTO wsfalerts(bulletinid, alert) VALUES %L ON CONFLICT (bulletinid) DO NOTHING RETURNING *`, alerts);

  pool
    .query(sql)
    .then(res => {
      console.log(res.rowCount ? `added new alert(s): ${res.rows.map(row => ' ' + row.bulletinid)}` : 'no new alerts');
    })
    .catch(err => {
      setImmediate(() => {
        throw err
      })
    })
}

// Poll WSF every 10m for new alerts
cron.schedule(`*/10 * * * *`, async () => {
  console.log(`running wsf alert query at ${new Date().toLocaleString('en-US', { timeZone: 'PST' })}`);
  wsfQuery();
});
