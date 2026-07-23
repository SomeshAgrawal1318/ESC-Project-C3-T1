import mongoose from 'mongoose';

const studentSchema = mongoose.Schema(
{
    username: {
      type: String,
      required: [true, 'Please add a username value'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email value'],
      unique: [true, 'Email address already taken'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password value'],
    },
  },
  {
    timestamps: true,
  },
);
export default mongoose.model('Student',studentSchema);