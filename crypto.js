/* Cryptographic helpers. Passwords and vault contents use Web Crypto only. */
const VaultCrypto = (() => {
  const ITERATIONS = 600000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = n => crypto.getRandomValues(new Uint8Array(n));
  const b64 = arr => btoa(String.fromCharCode(...new Uint8Array(arr)));
  const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  async function derive(passphrase, salt, iterations=ITERATIONS) {
    const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"}, material, {name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]);
  }
  async function encryptText(text, passphrase) {
    const salt=bytes(16), iv=bytes(12), key=await derive(passphrase,salt);
    const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(text));
    return {cipher:b64(cipher),salt:b64(salt),iv:b64(iv),iterations:ITERATIONS};
  }
  async function decryptText(record, passphrase) {
    const key=await derive(passphrase,unb64(record.salt),record.iterations);
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(record.iv)},key,unb64(record.cipher));
    return dec.decode(plain);
  }
  async function encryptAppPassword(password, pin) { return encryptText(password,pin); }
  async function decryptAppPassword(record, pin) { return decryptText(record,pin); }
  async function encryptVault(data, passphrase) {
    const payload=await encryptText(JSON.stringify(data),passphrase);
    return {version:1,globalLock:true,payload};
  }
  async function decryptVault(record, passphrase) {
    return JSON.parse(await decryptText(record.payload,passphrase));
  }
  async function makeVerifier(passphrase) {
    // A verifier is itself encrypted with the derived key; no PIN/passphrase is stored.
    return encryptText("SpellVault verification",passphrase);
  }
  return {encryptAppPassword,decryptAppPassword,encryptVault,decryptVault,makeVerifier,encryptText,decryptText};
})();