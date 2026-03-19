package com.vault.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    private boolean isSmtpConfigured() {
        return fromAddress != null && !fromAddress.isBlank() && !fromAddress.equals("your-email@gmail.com");
    }

    @Async
    public void sendNewSecretNotification(String recipientEmail, String recipientUsername, String senderUsername) {
        if (!isSmtpConfigured()) { log.info("SMTP not configured — skipping email to {}", recipientEmail); return; }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress); helper.setTo(recipientEmail);
            helper.setSubject("🔐 New Secret Received — WhisperVault");
            helper.setText(buildNewSecretHtml(recipientUsername, senderUsername), true);
            mailSender.send(message);
            log.info("New secret notification sent to {}", recipientEmail);
        } catch (Exception e) { log.warn("Failed to send new-secret email (non-fatal): {}", e.getMessage()); }
    }

    @Async
    public void sendSecretBurnedNotification(String senderEmail, String senderUsername, String recipientUsername) {
        if (!isSmtpConfigured()) { log.info("SMTP not configured — skipping burn email to {}", senderEmail); return; }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress); helper.setTo(senderEmail);
            helper.setSubject("🔥 Your Secret Was Read — WhisperVault");
            helper.setText(buildBurnedHtml(senderUsername, recipientUsername), true);
            mailSender.send(message);
            log.info("Burn notification sent to {}", senderEmail);
        } catch (Exception e) { log.warn("Failed to send burn email (non-fatal): {}", e.getMessage()); }
    }

    @Async
    public void sendGroupRoomInvite(String recipientEmail, String recipientUsername,
            String inviterUsername, String roomId, String inviteToken) {
        if (!isSmtpConfigured()) { log.info("SMTP not configured — skipping group invite to {}", recipientEmail); return; }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress); helper.setTo(recipientEmail);
            helper.setSubject("⚡ Secret Chat Room Invite — WhisperVault");
            helper.setText(buildGroupInviteHtml(recipientUsername, inviterUsername, roomId, inviteToken), true);
            mailSender.send(message);
            log.info("Group room invite sent to {} for room {}", recipientEmail, roomId);
        } catch (Exception e) { log.warn("Failed to send group invite email (non-fatal): {}", e.getMessage()); }
    }

    private String buildNewSecretHtml(String recipient, String sender) {
        return "<div style=\"font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:40px;max-width:600px\">"
            + "<h1 style=\"color:#ff6b35\">⚡ WHISPER VAULT</h1>"
            + "<p>Hello <strong>" + recipient + "</strong>,</p>"
            + "<p><strong>" + sender + "</strong> has sent you a secret message.</p>"
            + "<p style=\"color:#aaa\">This message self-destructs on read.</p>"
            + "<a href=\"" + frontendUrl + "/inbox\" style=\"display:inline-block;background:#ff6b35;color:#000;padding:12px 24px;text-decoration:none;font-weight:bold;margin-top:16px\">OPEN INBOX</a>"
            + "</div>";
    }

    private String buildBurnedHtml(String sender, String recipient) {
        return "<div style=\"font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:40px;max-width:600px\">"
            + "<h1 style=\"color:#ff6b35\">⚡ WHISPER VAULT</h1>"
            + "<p>Hello <strong>" + sender + "</strong>,</p>"
            + "<p><strong>" + recipient + "</strong> has read and destroyed your secret.</p>"
            + "<p style=\"color:#aaa\">No copy remains on our servers.</p>"
            + "</div>";
    }

    private String buildGroupInviteHtml(String recipient, String inviter, String roomId, String token) {
        String backendUrl = frontendUrl.contains(":5173") ? frontendUrl.replace(":5173", ":8080") : frontendUrl;
        String verifyUrl = backendUrl + "/api/rooms/verify/" + token + "?username=" + recipient;
        return "<div style=\"font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:40px;max-width:600px\">"
            + "<h1 style=\"color:#ff6b35\">⚡ WHISPER VAULT</h1>"
            + "<div style=\"background:#111;border:1px solid #333;padding:20px;border-radius:8px;margin:20px 0\">"
            + "<p style=\"margin:0 0 8px;color:#aaa;font-size:12px;letter-spacing:2px\">SECURE CHAT INVITE</p>"
            + "<p>Hello <strong>" + recipient + "</strong>,</p>"
            + "<p><strong>" + inviter + "</strong> has invited you to a Secret Group Vault Room.</p>"
            + "<p style=\"color:#ff6b35;font-size:12px\">⚠ Ephemeral. E2E encrypted. Auto-purged when all leave.</p>"
            + "</div>"
            + "<div style=\"background:#1a1a1a;border:1px solid #ff6b3555;padding:16px;border-radius:8px;margin:20px 0\">"
            + "<p style=\"margin:0 0 8px;color:#aaa;font-size:11px;letter-spacing:2px\">SECURITY NOTICE</p>"
            + "<p style=\"margin:0;font-size:13px;color:#ccc\">This link takes you to a <strong>Verification Landing Page</strong>. You must sign in with your WhisperVault credentials. Link expires in 30 minutes.</p>"
            + "</div>"
            + "<a href=\"" + verifyUrl + "\" style=\"display:inline-block;background:#ff6b35;color:#000;padding:14px 28px;text-decoration:none;font-weight:bold;border-radius:4px;letter-spacing:2px\">VERIFY &amp; ENTER VAULT</a>"
            + "<p style=\"margin-top:24px;color:#555;font-size:11px\">Room ID: " + roomId + "</p>"
            + "</div>";
    }
}
