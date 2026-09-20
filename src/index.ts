import 'dotenv/config';
import express from 'express';
import { searchRouter } from './routes/search';

const app = express();
app.use(express.json());

app.use('/search', searchRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`QueryNest listening on http://localhost:${PORT}`);
});
