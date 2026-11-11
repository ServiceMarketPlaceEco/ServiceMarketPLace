import { AdminNotifierService } from './admin-notifier.service';

describe('AdminNotifierService', () => {
  let admins: any;
  let mail: any;
  let notifier: AdminNotifierService;

  beforeEach(() => {
    admins = { find: jest.fn(async () => [{ email: 'a@x.com' }, { email: 'b@x.com' }]) };
    mail = { sendAdminNotification: jest.fn() };
    notifier = new AdminNotifierService(admins, mail);
  });

  it('emails every active admin', async () => {
    await notifier.notify('Review waiting for approval', 'A customer wrote a review.', 'Great job');

    expect(admins.find.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(mail.sendAdminNotification).toHaveBeenCalledWith(
      ['a@x.com', 'b@x.com'],
      'Review waiting for approval',
      'A customer wrote a review.',
      'Great job',
    );
  });

  it('never throws, so a failed email cannot stop the action that caused it', async () => {
    admins.find.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(notifier.notify('x', 'y')).resolves.toBeUndefined();
  });
});
