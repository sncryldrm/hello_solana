/**
 * Hello solana
 */

import {
  establishConnection,
  establishPayer,
  loadProgram,
  sayHello,
} from './deploy';

async function main() {
  console.log("Let's say hello to Solana...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Load the program if not already loaded
  await loadProgram();

  // Load the program if not already loaded
  await sayHello();
  
  console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
