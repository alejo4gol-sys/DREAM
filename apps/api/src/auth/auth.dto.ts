import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'La contraseña debe tener mínimo 8 caracteres, con letras y números';

export class RegisterDto {
  @IsString() @Length(2, 160) fullName: string;
  @Transform(lower) @IsEmail({}, { message: 'Correo inválido' }) @MaxLength(255) email: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsBoolean() @Equals(true, { message: 'Debes aceptar la política de tratamiento de datos' }) acceptPolicy: boolean;
}

export class LoginDto {
  @Transform(lower) @IsEmail({}, { message: 'Correo inválido' }) email: string;
  @IsString() @MaxLength(128) password: string;
}

export class TwoFactorLoginDto {
  @IsString() challengeToken: string;
  @IsString() @Length(6, 6) code: string;
}

export class ForgotPasswordDto {
  @Transform(lower) @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() @Length(20, 200) token: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) newPassword: string;
}

export class TwoFactorCodeDto {
  @IsString() @Length(6, 6) code: string;
}

export class DisableTwoFactorDto {
  @IsString() password: string;
  @IsString() @Length(6, 6) code: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 160) fullName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  /** Redes sociales personales: { instagram, tiktok, linkedin, … } */
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}
