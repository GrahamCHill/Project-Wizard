#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SpinningActor.generated.h"

UCLASS()
class __UNREAL_API__ ASpinningActor : public AActor
{
    GENERATED_BODY()

public:
    ASpinningActor();
    void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, Category = "Demo")
    float DegreesPerSecond = 60.0f;
};
