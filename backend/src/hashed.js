import bcrypt from 'bcryptjs';

const password = 'mithilesh123';

const hashedPassword = await bcrypt.hash(password, 10);

console.log('Original Password:', password);
console.log('Hashed Password:', hashedPassword);