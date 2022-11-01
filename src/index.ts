import cron from 'node-cron';
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
    .then((response: { data: any; }) => {
      (response.data.map((rawAlert: any) => {
        saveAlert(rawAlert);
      }
      ));
    })
    .catch((error: any) => {
      console.log(error);
    });
}

async function saveAlert(alert: any) {
  const text = 'INSERT INTO wsfalerts(bulletinid, alert) VALUES($1, $2) ON CONFLICT (bulletinid) DO NOTHING RETURNING *'
  const values: [number, any] = [alert.BulletinID, alert]

  pool
    .query(text, values)
    .then(res => {
      console.log(res.rows[0])
    })
    .catch(err => {
      setImmediate(() => {
        throw err
      })
    })
}

cron.schedule(`0 * * * *`, async () => {
  console.log(`running wsf alert query ${new Date().toTimeString()}`);
  wsfQuery();
});
