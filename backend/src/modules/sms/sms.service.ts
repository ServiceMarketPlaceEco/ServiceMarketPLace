import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Sends text messages through Twilio's REST API.
//
// It only switches on when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_FROM are all set. Without them isConfigured() is false and the
// auth service falls back to printing the code in the terminal (development
// only). We call the API with fetch instead of the Twilio package so there is
// nothing extra to install.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly from?: string;
  private readonly countryCode: string;

  constructor(private configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || undefined;
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || undefined;
    this.from = this.configService.get<string>('TWILIO_FROM') || undefined;
    // our customers type local numbers like 01712345678, Twilio needs +8801712345678
    this.countryCode = this.configService.get<string>('SMS_DEFAULT_COUNTRY_CODE', '+880');

    if (!this.isConfigured() && this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('No SMS provider is set up (TWILIO_* in .env), so customers cannot get their signup code');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.from);
  }

  // turns a local number into the international format Twilio expects
  //   01712345678     -> +8801712345678 (with the default +880)
  //   +61 412 345 678 -> +61412345678
  //   0061412345678   -> +61412345678
  toInternational(phone: string): string {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
    const local = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
    return `${this.countryCode}${local}`;
  }

  // throws if Twilio says no, so the caller can tell the customer to try again
  async send(phone: string, message: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('SMS provider is not configured');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: this.toInternational(phone),
      From: this.from as string,
      Body: message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Twilio explains the problem in the body (for example an unverified
      // number on a trial account). We log it but never the code itself.
      const detail = await response.text().catch(() => '');
      this.logger.error(`Twilio returned ${response.status}: ${detail.slice(0, 300)}`);
      throw new Error(`SMS send failed with status ${response.status}`);
    }
  }
}
