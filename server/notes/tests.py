from django.contrib.auth import get_user_model
from django.test import TestCase
from notes.models import Note

from core.testing import JWTAPITestCase

User = get_user_model()

LIST_URL = "/api/notes/"
TEST_PASSWORD = "StrongPass123"


def make_user(username: str):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def detail_url(pk: int) -> str:
    return f"{LIST_URL}{pk}/"


def test_note_model_shape():
    user = User.objects.create_user(username="u1", email="u1@example.com", password="StrongPass123")
    n = Note.objects.create(owner=user, title="Groceries", description="Buy milk")
    assert n.title == "Groceries"
    assert n.created_at is not None and n.updated_at is not None


class NoteModelTests(TestCase):
    """Discoverable wrapper so Django's unittest runner executes the model shape test."""

    def test_note_model_shape(self):
        test_note_model_shape()


class NoteAPISmokeTests(JWTAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="smoke",
            email="smoke@example.com",
            password="StrongPass123",
        )

    def test_create_note_returns_201(self):
        self.auth(self.user)
        res = self.client.post("/api/notes/", {"title": "Hello", "description": "World"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["title"], "Hello")


class NoteAPITests(JWTAPITestCase):
    def setUp(self):
        self.user = make_user("alice_notes")
        self.alice = self.user
        self.bob = make_user("bob_notes")

    def test_list_ordered_newest_first(self):
        self.auth(self.user)
        self.client.post("/api/notes/", {"title": "A"}, format="json")
        self.client.post("/api/notes/", {"title": "B"}, format="json")
        res = self.client.get("/api/notes/")
        self.assertEqual([r["title"] for r in res.data], ["B", "A"])

    def test_blank_title_rejected(self):
        self.auth(self.user)
        res = self.client.post("/api/notes/", {"title": "   "}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("title", res.data)

    def test_title_too_long_rejected(self):
        self.auth(self.user)
        res = self.client.post("/api/notes/", {"title": "x" * 201}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_description_optional_and_capped(self):
        self.auth(self.user)
        res = self.client.post("/api/notes/", {"title": "T"}, format="json")
        self.assertEqual(res.status_code, 201)
        res2 = self.client.post("/api/notes/", {"title": "T2", "description": "x" * 2001}, format="json")
        self.assertEqual(res2.status_code, 400)

    def test_cross_user_concealed(self):
        n = Note.objects.create(owner=self.alice, title="Mine", description="")
        self.auth(self.bob)
        self.assertEqual(self.client.get("/api/notes/").data, [])
        self.assertEqual(self.client.get(f"/api/notes/{n.id}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/notes/{n.id}/", {"title": "X"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/notes/{n.id}/").status_code, 404)

    def test_anonymous_401_on_all_five_routes(self):
        self.client.credentials()
        owner = User.objects.create_user(username="anon_owner", email="a@e.com", password="StrongPass123")
        n = Note.objects.create(owner=owner, title="X", description="")
        cases = [
            self.client.get("/api/notes/"),
            self.client.post("/api/notes/", {"title": "T"}, format="json"),
            self.client.get(f"/api/notes/{n.id}/"),
            self.client.patch(f"/api/notes/{n.id}/", {"title": "Y"}, format="json"),
            self.client.delete(f"/api/notes/{n.id}/"),
        ]
        for res in cases:
            self.assertEqual(res.status_code, 401)

    def test_owner_and_timestamps_immutable(self):
        self.auth(self.user)
        res = self.client.post("/api/notes/", {"title": "T", "owner": 9999}, format="json")
        self.assertNotIn("owner", res.data)
        nid = res.data["id"]
        orig_created = res.data["created_at"]
        res2 = self.client.patch(f"/api/notes/{nid}/", {"title": "T2", "owner": 9999, "created_at": "2000-01-01T00:00:00Z", "updated_at": "2000-01-01T00:00:00Z"}, format="json")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["title"], "T2")
        self.assertNotIn("owner", res2.data)
        self.assertEqual(res2.data["created_at"], orig_created)

    def test_schema_documents_notes_routes(self):
        from drf_spectacular.generators import SchemaGenerator
        schema = SchemaGenerator().get_schema(public=True)
        self.assertIn("/api/notes/", schema["paths"])
        self.assertIn("/api/notes/{id}/", schema["paths"])
