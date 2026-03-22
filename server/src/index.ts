import { config } from './config/index.js';
import app from './app.js';

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
