import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Text, JSON


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)


class WebhookRawLog(db.Model):
    __tablename__ = 'webhook_raw_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    received_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    source_ip = db.Column(db.String(50), nullable=True)
    headers = db.Column(JSON, nullable=True)
    payload = db.Column(JSON, nullable=True)
    raw_body = db.Column(Text, nullable=True)
    processing_status = db.Column(db.String(20), nullable=False, default='pending')
    error_message = db.Column(Text, nullable=True)
    processed_at = db.Column(db.DateTime, nullable=True)
    
    def __repr__(self):
        return f'<WebhookRawLog {self.id} - {self.processing_status}>'


class Conversation(db.Model):
    __tablename__ = 'conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    zendesk_conversation_id = db.Column(db.String(255), nullable=False, unique=True, index=True)
    zendesk_app_id = db.Column(db.String(255), nullable=True)
    user_id = db.Column(db.String(255), nullable=True)
    user_external_id = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='active')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata_json = db.Column(JSON, nullable=True)
    
    messages = db.relationship('Message', backref='conversation', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Conversation {self.zendesk_conversation_id}>'


class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False, index=True)
    zendesk_message_id = db.Column(db.String(255), nullable=True, index=True)
    author_type = db.Column(db.String(50), nullable=False)
    author_id = db.Column(db.String(255), nullable=True)
    author_name = db.Column(db.String(255), nullable=True)
    content_type = db.Column(db.String(50), nullable=False, default='text')
    content_text = db.Column(Text, nullable=True)
    content_payload = db.Column(JSON, nullable=True)
    received_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    zendesk_timestamp = db.Column(db.DateTime, nullable=True)
    metadata_json = db.Column(JSON, nullable=True)
    webhook_log_id = db.Column(db.Integer, db.ForeignKey('webhook_raw_logs.id'), nullable=True)
    
    def __repr__(self):
        return f'<Message {self.id} from {self.author_type}>'
