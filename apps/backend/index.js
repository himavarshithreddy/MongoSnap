const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('MongoPilot backend running');
});

app.listen(4000,'0.0.0.0', () => {
  console.log("Backend running on http://localhost:4000");
});
