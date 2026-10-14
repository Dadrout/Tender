"""Source adapters have explicit provenance and no fictional live API."""

from abc import ABC, abstractmethod
from .schemas import Tender


class SourceAdapter(ABC):
    name: str
    data_type: str

    @abstractmethod
    def search(self, keyword: str = "") -> list[Tender]: ...


class ImportedAdapter(SourceAdapter):
    name = "Uploaded procurement documents"
    data_type = "imported"

    def __init__(self, records: list[Tender]):
        self.records = records

    def search(self, keyword=""):
        return [
            r for r in self.records if keyword.lower() in r.model_dump_json().lower()
        ]


class OfficialAdapter(SourceAdapter):
    data_type = "live_verified"

    def __init__(self, name: str):
        self.name = name

    def search(self, keyword=""):
        raise RuntimeError(
            f"{self.name}: официальный адаптер не подключён. Требуется документированный API и авторизация. Используйте импорт документов."
        )


OFFICIAL_SOURCES = [
    OfficialAdapter("Goszakup.gov.kz"),
    OfficialAdapter("Samruk-Kazyna"),
]
