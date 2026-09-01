import { Role } from "src/common/enums/role.enum";
import { FilesController } from "./files.controller";

function createMockResponse() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  };
}

describe("FilesController", () => {
  it("resolves vehicle photos by their local object key", async () => {
    const vehiclePhotoRepository = {
      findOne: jest.fn().mockResolvedValue({
        objectKey: "vehicle-photos/stored-photo.jpg",
        mimeType: "image/jpeg",
        record: {
          delegation: {
            id: "delegation-1",
            region: { id: "region-1" },
          },
        },
      }),
    };
    const messagePhotoRepository = { findOne: jest.fn() };
    const storageService = {
      getObject: jest.fn().mockResolvedValue({
        buffer: Buffer.from("image"),
        mimeType: "image/jpeg",
        size: 5,
      }),
    };
    const response = createMockResponse();
    const controller = new FilesController(
      vehiclePhotoRepository as never,
      messagePhotoRepository as never,
      storageService as never,
    );

    await controller.getVehiclePhoto(
      "stored-photo.jpg",
      {
        sub: "user-1",
        role: Role.SuperAdmin,
        regionId: null,
        delegationId: null,
      },
      response as never,
    );

    expect(vehiclePhotoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { objectKey: "vehicle-photos/stored-photo.jpg" },
      }),
    );
    expect(storageService.getObject).toHaveBeenCalledWith(
      "vehicle-photos/stored-photo.jpg",
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("image"));
  });

  it("resolves message attachments by their local object key", async () => {
    const vehiclePhotoRepository = { findOne: jest.fn() };
    const messagePhotoRepository = {
      findOne: jest.fn().mockResolvedValue({
        objectKey: "message-photos/stored-message.jpg",
        mimeType: "image/jpeg",
        message: {
          conversation: {
            participants: [{ id: "user-1" }],
          },
        },
      }),
    };
    const storageService = {
      getObject: jest.fn().mockResolvedValue({
        buffer: Buffer.from("message-image"),
        mimeType: "image/jpeg",
        size: 13,
      }),
    };
    const response = createMockResponse();
    const controller = new FilesController(
      vehiclePhotoRepository as never,
      messagePhotoRepository as never,
      storageService as never,
    );

    await controller.getMessageAttachment(
      "stored-message.jpg",
      {
        sub: "user-1",
        role: Role.Enlace,
        regionId: null,
        delegationId: "delegation-1",
      },
      response as never,
    );

    expect(messagePhotoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { objectKey: "message-photos/stored-message.jpg" },
      }),
    );
    expect(storageService.getObject).toHaveBeenCalledWith(
      "message-photos/stored-message.jpg",
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("message-image"));
  });
});
