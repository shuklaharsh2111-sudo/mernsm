import bcrypt from 'bcryptjs';

const password = 'yourpswd';

const hashedPassword = await bcrypt.hash(password, 10);

console.log('Original Password:', password);
console.log('Hashed Password:', hashedPassword);