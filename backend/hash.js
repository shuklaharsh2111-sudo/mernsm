
import bcrypt from 'bcryptjs';

const password = 'your_password';

const hashPassword = async () => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Original Password:', password);
    console.log('Hashed Password:', hashedPassword);
  } catch (error) {
    console.error('Hashing Error:', error);
  }
};

hashPassword();
