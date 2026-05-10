from autoflipr.email import send_password_reset


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    send_password_reset(to_email, reset_url)
