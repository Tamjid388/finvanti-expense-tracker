from rest_framework.routers import DefaultRouter

from .views import NoteViewSet

router = DefaultRouter()
router.register("", NoteViewSet, basename="notes")

urlpatterns = router.urls
