from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
import re
from .models import Profile
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer




class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        # Django built-in validators (common password check etc.) + our custom one
        validators=[validate_password],
    )
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name')

    def validate_email(self, value):
        if value:
            email_clean = value.strip().lower()
            if User.objects.filter(email__iexact=email_clean).exists():
                raise serializers.ValidationError("A user with this email address already exists.")
            return email_clean
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        user.set_password(validated_data['password'])
        user.save()
        # ensure a Profile exists for the new user
        Profile.objects.get_or_create(user=user)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", required=False)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=True, allow_blank=False)
    last_name = serializers.CharField(source="user.last_name", required=True, allow_blank=False)
    has_usable_password = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone_number",
            "date_of_birth",
            "gender",
            "country",
            "state",
            "city",
            "has_usable_password",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "role", "has_usable_password", "created_at", "updated_at"]

    def get_has_usable_password(self, obj):
        return obj.user.has_usable_password()

    def validate(self, attrs):
        user_data = attrs.get("user", {})
        new_username = user_data.get("username")
        if new_username:
            request = self.context.get("request")
            current_user = request.user if request else None
            qs = User.objects.filter(username=new_username)
            if current_user:
                qs = qs.exclude(pk=current_user.pk)
            if qs.exists():
                raise serializers.ValidationError({"username": "This username is already taken."})
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        # email is managed separately via OTP flow — never update here
        user_data.pop("email", None)
        user = instance.user

        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_superuser'] = user.is_superuser
        profile, _ = Profile.objects.get_or_create(user=user)
        token['role'] = profile.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        
        user = self.user
        data['id'] = user.id
        data['username'] = user.username
        data['email'] = user.email
        data['is_superuser'] = user.is_superuser
        
        profile, _ = Profile.objects.get_or_create(user=user)
        data['role'] = profile.role
        
        return data

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None

        if user and user.has_usable_password():
            old_password = attrs.get('old_password')
            if not old_password:
                raise serializers.ValidationError({"old_password": "This field is required."})
            if old_password == attrs.get('new_password'):
                raise serializers.ValidationError({"new_password": "New password cannot be the same as the old password."})
        
        return attrs

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower() if value else value


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True, write_only=True)
    otp = serializers.CharField(required=True, write_only=True, max_length=6, min_length=6)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        return value.strip().lower() if value else value

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class RequestEmailOTPSerializer(serializers.Serializer):
    new_email = serializers.EmailField(required=True)

    def validate_new_email(self, value):
        request = self.context.get("request")
        current_email = request.user.email if request else None
        if value.lower() == (current_email or "").lower():
            raise serializers.ValidationError("This is already your current email address.")
        return value


class VerifyEmailOTPSerializer(serializers.Serializer):
    new_email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, max_length=6, min_length=6)

class LogoutSerializer(serializers.Serializer):
    # refresh is no longer required — the token is read from the HttpOnly cookie.
    # This field is kept for backwards compatibility with API clients using the header flow.
    refresh = serializers.CharField(required=False, allow_blank=True)
