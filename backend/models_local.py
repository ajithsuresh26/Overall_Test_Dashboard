# -*- coding: utf-8 -*-
# backend/models_local.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database_local import Base

class LocalClientEmailConfig(Base):
    """Per-client localized outgoing SMTP parameters."""
    __tablename__ = "client_email_configs"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, unique=True, nullable=False)

    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(255), nullable=True)
    smtp_pass = Column(String(500), nullable=True)
    sender_name = Column(String(255), default="Safety Alert")
    use_tls = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LocalSafetyOfficer(Base):
    """Safety analysts configured strictly on this client instance workspace."""
    __tablename__ = "safety_officers"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(100), default="Safety Officer")
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    alert_email = Column(Boolean, default=True)
    alert_sms = Column(Boolean, default=False)
    alert_whatsapp = Column(Boolean, default=False)
    min_severity = Column(String(20), default="Low")

    alert_logs = relationship("LocalAlertLog", back_populates="officer")


class LocalAnomaly(Base):
    """Direct edge computer vision frame capture pipeline logs."""
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), nullable=False)
    type = Column(String(100), nullable=False)
    observation_type = Column(String(150), nullable=True)
    activity = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())


class LocalAlertLog(Base):
    """Execution dispatch history logs."""
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomalies.id"), nullable=True)
    robot_id = Column(String(50), nullable=False)
    client_id = Column(Integer, nullable=False)
    officer_id = Column(Integer, ForeignKey("safety_officers.id"), nullable=True)
    channel = Column(String(20), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="sent")
    error_detail = Column(Text, nullable=True)
    sent_at = Column(DateTime, server_default=func.now())

    officer = relationship("LocalSafetyOfficer", back_populates="alert_logs")