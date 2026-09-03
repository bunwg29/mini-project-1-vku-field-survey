import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/surveys', (req, res) => {

  const survey = req.body;

  console.log(
    'Received survey:',
    survey
  );

  res.json({
    success: true,
    id: survey.id,
  });
});

app.listen(3000, () => {
  console.log(
    'API running at http://localhost:3000'
  );
});