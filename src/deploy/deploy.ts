/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
// @ts-ignore
import fs from 'mz/fs';
// @ts-ignore
import BufferLayout from 'buffer-layout';

import {Store} from './util/store';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Connection to the network
 */
let payerAccount: Account;

/**
 * Hello solana's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let greetedPubkey: PublicKey;

const url = 'https://devnet.solana.com';

const pathToProgram = 'src/release/hello_solana.so';

/**
 * Layout of the greeted account data
 */
const greetedAccountDataLayout = BufferLayout.struct([
  BufferLayout.u32('numGreets'),
]);

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  connection = new Connection(url, 'singleGossip');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', url, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  if (!payerAccount) {
    payerAccount = new Account();
    await connection.requestAirdrop(payerAccount.publicKey, 1000000000); // 1000000000 lamports = 1 SOL
  }

  const lamports = await connection.getBalance(payerAccount.publicKey);
  console.log(
    'Using account',
    payerAccount.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'Sol to pay for fees',
  );
}

/**
 * Load the hello solana BPF program if not already loaded
 */
export async function loadProgram(): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  try {
    const config = await store.load('config.json');
    programId = new PublicKey(config.programId);
    greetedPubkey = new PublicKey(config.greetedPubkey);
    await connection.getAccountInfo(programId);
    console.log('Program already loaded to account', programId.toBase58());
    return;
  } catch (err) {
    // try to load the program
  }

  // Load the program
  console.log('Loading hello solana program...');
  const data = await fs.readFile(pathToProgram);
  const programAccount = new Account();
  await BpfLoader.load(
    connection,
    payerAccount,
    programAccount,
    data,
    BPF_LOADER_PROGRAM_ID,
  );
  programId = programAccount.publicKey;
  console.log('Program loaded to account', programId.toBase58());

  // Create the greeted account
  const greetedAccount = new Account();
  greetedPubkey = greetedAccount.publicKey;
  console.log('Creating account', greetedPubkey.toBase58(), 'to say hello to');
  const space = greetedAccountDataLayout.span;
  const lamports = await connection.getMinimumBalanceForRentExemption(
    greetedAccountDataLayout.span,
  );
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payerAccount.publicKey,
      newAccountPubkey: greetedPubkey,
      lamports,
      space,
      programId,
    }),
  );
  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payerAccount, greetedAccount],
    {
      commitment: 'singleGossip',
      preflightCommitment: 'singleGossip',
    },
  );

  // Save this info for next time
  await store.save('config.json', {
    url: url,
    programId: programId.toBase58(),
    greetedPubkey: greetedPubkey.toBase58(),
  });
}

/**
 * Say hello
 */
export async function sayHello(): Promise<void> {
  console.log('Saying hello to', greetedPubkey.toBase58());
  const instruction = new TransactionInstruction({
    keys: [{pubkey: greetedPubkey, isSigner: false, isWritable: true}],
    programId,
    data: Buffer.alloc(0), // All instructions are hellos
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payerAccount],
    {
      commitment: 'singleGossip',
      preflightCommitment: 'singleGossip',
    },
  );
}