from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

Nonnegative = Annotated[
    Decimal, Field(ge=0, allow_inf_nan=False, max_digits=16, decimal_places=4)
]
Percent = Annotated[Decimal, Field(ge=0, le=100, allow_inf_nan=False)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Requirement(Model):
    key: str = Field(max_length=100)
    label: str = Field(max_length=200)
    value: str = Field(max_length=1000)
    page: int = Field(ge=1, le=100)
    evidence: str = Field(max_length=3000)
    critical: bool = True
    confidence: float = Field(default=1, ge=0, le=1)
    origin: Literal["document", "manual", "ai"] = "document"


class LineItem(Model):
    name: str = Field(min_length=1, max_length=500)
    quantity: Nonnegative | None = None
    unit: str = "шт"
    page: int = Field(default=1, ge=1, le=100)
    evidence: str = Field(default="", max_length=3000)
    category: str | None = None
    origin: Literal["document", "manual", "ai"] = "document"
    requirements: list[Requirement] = Field(default_factory=list, max_length=80)


class Tender(Model):
    title: str = Field(default="Загруженная спецификация", min_length=1, max_length=500)
    identifier: str | None = None
    buyer: str | None = None
    region: str | None = None
    source: str = "Загруженный документ"
    method: str | None = None
    budget: Nonnegative | None = None
    deadline: str | None = None
    delivery_date: str | None = None
    delivery_days: int | None = Field(default=None, ge=0, le=3650)
    payment_days: int | None = Field(default=None, ge=0, le=3650)
    delivery_evidence: str | None = None
    delivery_page: int | None = None
    payment_evidence: str | None = None
    payment_page: int | None = None
    synthetic: bool = False
    items: list[LineItem] = Field(default_factory=list, max_length=100)
    constraints: list[Requirement] = Field(default_factory=list, max_length=100)
    warnings: list[str] = Field(default_factory=list, max_length=50)


class Product(Model):
    id: int | None = None
    name: str = Field(min_length=1, max_length=500)
    sku: str = ""
    quantity: Nonnegative = Decimal("0")
    unit: str = "шт"
    acquisition_cost: Nonnegative | None = None
    supplier_cost: Nonnegative | None = None
    supplier: str | None = None
    supplier_confirmed: bool = False
    lead_days: int | None = Field(default=None, ge=0, le=3650)
    attributes: dict[str, str] = Field(default_factory=dict, max_length=100)
    raw: dict[str, str] = Field(default_factory=dict, max_length=100)
    row: int = Field(default=2, ge=1)
    manual_fields: list[str] = Field(default_factory=list)
    edited_at: str | None = None


class Scenario(Model):
    offer_price: Nonnegative = Decimal("90000")
    delivery: Nonnegative = Decimal("0")
    packaging: Nonnegative = Decimal("0")
    other: Nonnegative = Decimal("0")
    tax_rate: Percent = Decimal("0")
    target_margin: Percent = Decimal("20")
    annual_financing_rate: Percent = Decimal("0")
    payment_days: int = Field(default=30, ge=0, le=3650)
    advance_rate: Percent = Decimal("0")
    cash_available: Nonnegative = Decimal("50000")
    delivery_days: int = Field(default=5, ge=0, le=3650)
    line_overrides: dict[str, dict[str, Nonnegative | None]] = Field(
        default_factory=dict, max_length=100
    )

    @model_validator(mode="after")
    def valid_margin(self):
        if self.target_margin + self.tax_rate >= 100:
            raise ValueError(
                "Сумма целевой маржи и налоговой ставки должна быть меньше 100%"
            )
        allowed = {"quantity", "available", "acquisition_cost", "supplier_cost"}
        if any(set(v) - allowed for v in self.line_overrides.values()):
            raise ValueError("Неизвестное поле товарного сценария")
        return self
